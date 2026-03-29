import { ImageURLToFile, generateIdFromFile, getDataURL } from "@excalidraw/excalidraw/data/blob";
import { ExcalidrawImperativeAPI, BinaryFiles } from "@excalidraw/excalidraw/types";

export const convertLinksToImages = async (
  elements: any[],
  api: ExcalidrawImperativeAPI,
) => {
  const newFiles: BinaryFiles = {};
  const updatedElements = await Promise.all(
    elements.map(async (el) => {
      if (el.link && (el.type === "embeddable" || el.type === "image")) {
        try {
          const file = await ImageURLToFile(el.link);
          if (file) {
            const fileId = await generateIdFromFile(file);
            const dataURL = await getDataURL(file);
            newFiles[fileId] = {
              id: fileId,
              dataURL,
              mimeType: file.type as any,
              created: Date.now(),
            };
            return {
              ...el,
              type: "image",
              fileId,
              status: "saved",
              scale: [1, 1],
            };
          }
        } catch (e) {
          console.error("Failed to convert link to image:", el.link, e);
        }
      } else if (el.type === "image" && !el.fileId) {
        // If AI returned an image without a fileId or link, ensure it doesn't crash
        return {
          ...el,
          status: "error",
          scale: el.scale ?? [1, 1],
        };
      }
      return el;
    }),
  );

  const fileEntries = Object.values(newFiles);
  if (fileEntries.length > 0) {
    api.addFiles(fileEntries);
  }

  return updatedElements;
};
