import type {
  FileSelection,
  FileSelectionCallback,
  ReceiveCapability,
  VoidCallback,
} from "./types";

type SavePickerWindow = Window & {
  showOpenFilePicker?: (options: { multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
};

const selectedFiles = new Map<string, File>();
const activeUploads = new Map<string, XMLHttpRequest>();

export function selectFile(
  onSelected: FileSelectionCallback,
  onError: VoidCallback,
): void {
  const picker = savePickerWindow().showOpenFilePicker;
  if (picker) {
    void handleOpenFileSelection(picker, onSelected, onError);
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.style.display = "none";
  input.addEventListener("change", () => {
    void handleFileSelection(input, onSelected, onError);
  });
  document.body.appendChild(input);
  input.click();
}

export function receiveCapability(): ReceiveCapability {
  return "relay";
}

export function bindSelectedFile(clientOfferId: string, transferId: string): boolean {
  const file = selectedFiles.get(clientOfferId);
  if (!file) {
    return false;
  }

  selectedFiles.delete(clientOfferId);
  selectedFiles.set(transferId, file);
  return true;
}

export function discardSelectedFile(clientOfferId: string): void {
  selectedFiles.delete(clientOfferId);
}

export function uploadSelectedFile(
  transferId: string,
  uploadUrl: string,
  onProgress: (bytes: number, total: number) => void,
  onComplete: VoidCallback,
  onError: (reason: string) => void,
): void {
  const file = selectedFiles.get(transferId);
  if (!file) {
    onError("Selected file is no longer available.");
    return;
  }

  const request = new XMLHttpRequest();
  activeUploads.set(transferId, request);
  request.open("POST", uploadUrl);
  request.setRequestHeader("content-type", file.type || "application/octet-stream");

  request.upload.addEventListener("progress", (event) => {
    if (event.lengthComputable) {
      onProgress(event.loaded, event.total);
    }
  });

  request.addEventListener("load", () => {
    activeUploads.delete(transferId);
    if (request.status >= 200 && request.status < 300) {
      selectedFiles.delete(transferId);
      onComplete();
      return;
    }

    onError("Upload failed.");
  });

  request.addEventListener("error", () => {
    activeUploads.delete(transferId);
    onError("Upload failed.");
  });

  request.addEventListener("abort", () => {
    activeUploads.delete(transferId);
    onError("Upload cancelled.");
  });

  request.send(file);
}

export function cancelUpload(transferId: string): void {
  const request = activeUploads.get(transferId);
  activeUploads.delete(transferId);
  request?.abort();
}

export function downloadFile(downloadUrl: string): void {
  window.location.assign(downloadUrl);
}

async function handleOpenFileSelection(
  picker: NonNullable<SavePickerWindow["showOpenFilePicker"]>,
  onSelected: FileSelectionCallback,
  onError: VoidCallback,
): Promise<void> {
  try {
    const [handle] = await picker({ multiple: false });
    if (!handle) {
      onError();
      return;
    }

    completeFileSelection(await handle.getFile(), onSelected);
  } catch {
    onError();
  }
}

async function handleFileSelection(
  input: HTMLInputElement,
  onSelected: FileSelectionCallback,
  onError: VoidCallback,
): Promise<void> {
  const file = input.files?.[0];
  input.remove();

  if (!file) {
    onError();
    return;
  }

  completeFileSelection(file, onSelected);
}

function completeFileSelection(
  file: File,
  onSelected: FileSelectionCallback,
): void {
  const clientOfferId = randomId("offer");
  selectedFiles.set(clientOfferId, file);
  onSelected({
    client_offer_id: clientOfferId,
    name: file.name || "download",
    size: file.size,
    mime_type: file.type || "application/octet-stream",
  });
}

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function savePickerWindow(): SavePickerWindow {
  return window as SavePickerWindow;
}
