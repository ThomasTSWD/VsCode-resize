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
					vscode.window.showErrorMessage(
						"Aucun fichier ou dossier sélectionné."
					);
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
							// Si c'est un dossier, redimensionnez toutes les images à l'intérieur
							const files = await fs.promises.readdir(filePath);
							const imageFiles = files.filter((fileName) =>
								[".png", ".jpg", ".jpeg"].includes(
									path.extname(fileName).toLowerCase()
								)
							);

							await Promise.all(
								imageFiles.map(async (fileName) => {
									const imagePath = path.join(
										filePath,
										fileName
									);
									await resizeImage(imagePath, size);
								})
							);
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

async function resizeImage(filePath, size) {
	const imageBuffer = await fs.promises.readFile(filePath);

	const resizedImageBuffer = await sharp(imageBuffer)
		.resize({ width: size, height: size, fit: "inside" })
		.toBuffer();

	const outputPath = filePath.replace(
		/\.(png|jpg|jpeg)$/,
		`_resized_${size}x${size}.$1`
	);

	await fs.promises.writeFile(outputPath, resizedImageBuffer);

	vscode.window.showInformationMessage(
		`L'image ${path.basename(
			filePath
		)} a été redimensionnée et enregistrée sous ${path.basename(
			outputPath
		)}`
	);
}

function deactivate() {
	// Clean up resources here if necessary
}

module.exports = {
	activate,
	deactivate,
};
