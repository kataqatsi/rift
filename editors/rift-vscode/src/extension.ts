// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { MorphLanguageClient } from './client';
import { join } from 'path';
import { TextDocumentIdentifier } from 'vscode-languageclient';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // const infoview = new Infoview(context)
    // context.subscriptions.push(infoview)

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "rift" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('rift.run_helper', async () => {
        // get the current active cursor position
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.error('No active text editor found');
            return
        }
        // get the uri and position of the current cursor
        const doc = editor.document;
        const textDocument = { uri: doc.uri.toString(), version: 0 }
        const position = editor.selection.active;
        let task = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: 'Write the function body',
            prompt: 'Enter a description of what you want the helper to do...',
        });
        if (task === undefined) {
            console.log('run_helper task was cancelled')
            return
        }
        const r = await hslc.run_helper({ position, textDocument, task })
    });

    context.subscriptions.push(disposable);

    let hslc = new MorphLanguageClient(context)
    context.subscriptions.push(hslc)
    const provider = async (document, position, context, token) => {
        return [
            { insertText: await hslc.provideInlineCompletionItems(document, position, context, token) }
        ]
    };

    context.subscriptions.push(
        vscode.languages.registerInlineCompletionItemProvider(
            { pattern: "*" },
            { provideInlineCompletionItems: provider }
        )
    );
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider('*', hslc)
    )
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('RiftChat', new ChatView(context.extensionUri, hslc))
    )

}


export class ChatView implements vscode.WebviewViewProvider {

    private _view?: vscode.WebviewView;

    // In the constructor, we store the URI of the extension
    constructor(private readonly _extensionUri: vscode.Uri, public hslc: MorphLanguageClient) {
    }



    public resolveWebviewView(
        view: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = view;
        view.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };
        view.webview.html = this._getHtmlForWebview(view.webview);


        // const backgroundColor = new vscode.ThemeColor('editor.background'); can make this look nice for any given vscode theme but takes some extra work I'm not doing now

        view.webview.onDidReceiveMessage(data => {
            if (data.command === "copyText") {
                console.log('recieved copy in webview')
                vscode.env.clipboard.writeText(data.content)
                vscode.window.showInformationMessage('Text copied to clipboard!')
                return
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                console.error('No active text editor found');
                return
            }
            // get the uri and position of the current cursor
            const doc = editor.document;
            const position = editor.selection.active;
            const textDocument = { uri: doc.uri.toString(), version: 0 }
            if (!data.message || !data.messages) throw new Error()
            this.hslc.run_chat({ message: data.message, messages: data.messages, position, textDocument }, (progress) => {
                if (!this._view) throw new Error()
                if (progress.done) console.log('WEBVIEW DONE RECEIVEING / POSTING')
                this._view.webview.postMessage({ type: 'progress', data: progress });
            })


        });
    }


    private _getHtmlForWebview(webview: vscode.Webview) {
        const tailwindUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'tailwind.min.js'));
        const microlightUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'microlight.min.js'));
        const chatScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'chat.js'));
        const showdownUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'showdown.min.js'));

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="${tailwindUri}"></script>
            <script src="${microlightUri}"></script>
            <script src="${showdownUri}"></script>
            <style>
            code {
                font-family : monospace;
                white-space: pre;
            }
            </style>
        </head>
        <body>
            <script src="${chatScriptUri}"></script>
        </body>
        </html>`;
    }

}

// This method is called when your extension is deactivated
export function deactivate() { }
