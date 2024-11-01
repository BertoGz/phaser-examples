
// Function to copy a file from source to target
function copyFileSync(source, target) {
    let targetFile = target;

    // If target is a directory, create a new file with the same name
    if (tiled.fileExists(target)) {
        if (tiled.isDirectory(target)) {
            targetFile = tiled.path.join(target, tiled.path.baseName(source));
        }
    }

    tiled.file.copy(source, targetFile);
}

// Function to copy a folder recursively
function copyFolderRecursiveSync(source, target) {
    // Create target directory if it doesn't exist
    if (!tiled.fileExists(target)) {
        tiled.makeDirectory(target);
    }

    const files = tiled.file.listFiles(source);

    files.forEach(file => {
        const curSource = tiled.path.join(source, file);
        const targetPath = tiled.path.join(target, file);

        if (tiled.isDirectory(curSource)) {
            // Recursively copy the directory
            copyFolderRecursiveSync(curSource, targetPath);
        } else {
            // Copy the file
            copyFileSync(curSource, targetPath);
        }
    });
}


// Function to export a map and its associated assets
function exportMapAndAssets(mapFile, exportDir) {
    const map = tiled.open(mapFile);

    // Export the map to the export directory
    const mapExportPath = tiled.path.join(exportDir, tiled.path.baseName(mapFile));
    map.saveAs(mapExportPath);

    tiled.log(`Map exported to: ${mapExportPath}`);

    // Iterate through all tilesets used in the map
    for (let i = 0; i < map.tilesets.length; i++) {
        const tileset = map.tilesets[i];
        const tilesetFile = tileset.image;
        if (!tilesetFile) continue;

        const tilesetPath = tiled.path.join(tiled.path.dirname(mapFile), tilesetFile);
        const tilesetExportPath = tiled.path.join(exportDir, tilesetFile);

        // Copy the tileset and images to the export directory
        if (tiled.fileExists(tilesetPath)) {
            const tilesetDir = tiled.path.dirname(tilesetExportPath);
            if (!tiled.fileExists(tilesetDir)) {
                tiled.makeDirectory(tilesetDir);
            }
            copyFileSync(tilesetPath, tilesetExportPath);
            tiled.log(`Tileset exported to: ${tilesetExportPath}`);
        }
    }
}

// Function to export all maps in the project directory
function exportAllMaps(projectDir, exportDir) {
    // Ensure the export directory exists
    if (!tiled.fileExists(exportDir)) {
        tiled.makeDirectory(exportDir);
    }

    // Recursively find all TMX files in the project directory
    const files = tiled.file.listFiles(projectDir);
    files.forEach(file => {
        const fullPath = tiled.path.join(projectDir, file);

        // If the file is a directory, recurse into it
        if (tiled.isDirectory(fullPath)) {
            exportAllMaps(fullPath, exportDir);  // Recursively export maps from subdirectories
        } else if (file.endsWith(".tmx")) {
            // If the file is a TMX map, export it along with its assets
            exportMapAndAssets(fullPath, exportDir);
        }
    });
}


// Function to handle the export process
function handleExport() {
    // Get the currently open map file
    const currentMap = tiled.activeAsset;

    // Check if there is an active map and it's a valid file
    if (currentMap && currentMap.isTileMap) {
        const projectDir = tiled.projectFilePath;  // Get project directory from the currently opened map
        const exportDir = `${projectDir}/"export")`;  // Specify the export directory relative to project directory

        // Run the export for all maps in the project directory
        exportAllMaps(projectDir, exportDir);
        tiled.log("Export completed!");
    } else {
        tiled.log("No valid map is currently open. Please open a TMX map to export.");
    }
}



var action = tiled.registerAction("exportWorld", handleExport)

action.text = "Export World"


tiled.extendMenu("File", [
    { action: "exportWorld" },
    { separator: true }
]);
