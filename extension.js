const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function activate(context) {
    let disposable = vscode.commands.registerCommand(
        "extension.bulkResizeImages",
        async (uri) => {
            // Afficher une boîte de dialogue pour demander la taille du côté le plus long
            const sizeInput = await vscode.window.showInputBox({
                prompt: "Entrez la taille du côté le plus long (en pixels)",
                placeHolder: "Ex. 800",
                validateInput: (value) => {
                    if (!value.match(/^\d+$/)) {
                        return "La valeur doit être un nombre entier.";
                    }
                    return null;
                },
            });

            if (!sizeInput) {
                return; // L'utilisateur a annulé l'opération
            }

            const size = parseInt(sizeInput);
            let filePaths = [];

            if (uri && uri.fsPath) {
                // Si un chemin est sélectionné dans l'explorateur de fichiers, utilisez-le
                filePaths.push(uri.fsPath);
            } else {
                // Sinon, afficher un dialogue pour sélectionner un fichier ou un dossier
                const result = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: true,
                    canSelectMany: true,
                    openLabel: "Sélectionner",
                });

                if (!result || result.length === 0) {
                    vscode.window.showErrorMessage("Aucun fichier ou dossier sélectionné.");
                    return;
                }

                // Utiliser les chemins des fichiers ou dossiers sélectionnés
                filePaths = result.map((file) => file.fsPath);
            }

            try {
                // Redimensionner toutes les images sélectionnées
                await Promise.all(
                    filePaths.map(async (filePath) => {
                        const stat = await fs.promises.stat(filePath);

                        if (stat.isFile()) {
                            // Si c'est un fichier, redimensionnez-le directement
                            await resizeImage(filePath, size);
                        } else if (stat.isDirectory()) {
                            // Si c'est un dossier, traiter le dossier et les sous-dossiers
                            await processDirectory(filePath, size);
                        }
                    })
                );
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Une erreur s'est produite lors du redimensionnement des images : ${error}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}

// Fonction pour traiter un répertoire et ses sous-répertoires
async function processDirectory(directoryPath, requestedSize) {
    const files = await fs.promises.readdir(directoryPath);

    await Promise.all(
        files.map(async (fileName) => {
            const filePath = path.join(directoryPath, fileName);
            const stat = await fs.promises.stat(filePath);

            if (stat.isFile()) {
                await resizeImage(filePath, requestedSize);
            } else if (stat.isDirectory()) {
                await processDirectory(filePath, requestedSize); // Appel récursif pour les sous-dossiers
            }
        })
    );
}

async function resizeImage(filePath, requestedSize) {
    const extname = path.extname(filePath).toLowerCase();
    if (![
        ".png", ".jpg", ".jpeg", ".webp", ".tiff", ".heic",
        ".PNG", ".JPG", ".JPEG", ".WEBP", ".TIFF", ".HEIC"
    ].includes(extname)) {
        vscode.window.showWarningMessage(
            `Le fichier ${path.basename(filePath)} n'est pas une image valide (.png, .jpg, .jpeg). Il ne sera pas redimensionné.`
        );
        return;
    }

    try {
        const imageBuffer = await fs.promises.readFile(filePath);
        const imageMetadata = await sharp(imageBuffer).metadata();

        // Vérifier si la taille demandée est supérieure à la taille de l'image
        const maxSize = Math.max(imageMetadata.width, imageMetadata.height);
        if (requestedSize > maxSize) {
            vscode.window.showWarningMessage(
                `La taille demandée est supérieure à la taille maximale de l'image. L'image ne sera pas redimensionnée.`
            );
            return;
        }

        const resizedImageBuffer = await sharp(imageBuffer)
            .resize({
                width: requestedSize,
                height: requestedSize,
                fit: "inside",
            })
            .toBuffer();

        const resizedFileName = path.basename(filePath).replace(
            /\.(png|jpg|jpeg|webp|tiff|heic)$/,
            `_resized_${requestedSize}x${requestedSize}.$1`
        );
        const outputPath = path.join(path.dirname(filePath), resizedFileName);

        await fs.promises.writeFile(outputPath, resizedImageBuffer);

        vscode.window.showInformationMessage(
            `L'image ${path.basename(filePath)} a été redimensionnée et enregistrée sous ${path.basename(outputPath)}`
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Une erreur s'est produite lors du redimensionnement de l'image ${path.basename(filePath)} : ${error}`
        );
    }
}

function deactivate() {
    // Clean up resources here if necessary
}

module.exports = {
    activate,
    deactivate,
};
