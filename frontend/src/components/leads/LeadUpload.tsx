import { useRef, useState, type DragEvent } from "react";
import type { ParsedLeads } from "../../types/leads";
import { isSupportedLeadFile, parseLeadText } from "../../utils/leadParser";

type LeadUploadProps = {
  value: ParsedLeads | null;
  onChange: (leads: ParsedLeads | null) => void;
};

export function LeadUpload({ value, onChange }: LeadUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);

  async function handleFile(file: File) {
    setError(null);

    if (!isSupportedLeadFile(file)) {
      onChange(null);
      setError("Upload a CSV or TXT file.");
      return;
    }

    setIsReading(true);
    try {
      const content = await file.text();
      const parsed = parseLeadText(content, file.name);

      if (parsed.validEmails.length === 0) {
        setError("No valid email addresses were detected in this file.");
      }

      onChange(parsed);
    } catch {
      onChange(null);
      setError("Could not read this file. Try replacing it.");
    } finally {
      setIsReading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files.item(0);

    if (file) {
      void handleFile(file);
    }
  }

  function removeFile() {
    onChange(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          "rounded-lg border border-dashed bg-white p-6 transition",
          isDragging ? "border-cyan-500 bg-cyan-50" : "border-slate-300"
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleFile(file);
            }
          }}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">Upload leads</p>
            <p className="mt-1 text-sm text-slate-500">
              Drop a CSV/TXT file here, or select one from your device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {value ? "Replace file" : "Select file"}
          </button>
        </div>
      </div>

      {isReading ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Reading file...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {value ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">{value.filename}</p>
              <p className="mt-1 text-sm text-slate-600">
                {value.validEmails.length} valid email
                {value.validEmails.length === 1 ? "" : "s"} detected.
              </p>
              {value.duplicateCount > 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  Removed {value.duplicateCount} duplicate
                  {value.duplicateCount === 1 ? "" : "s"}.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Remove
            </button>
          </div>

          {value.invalidEntries.length > 0 ? (
            <div className="mt-4 rounded-md bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Invalid entries
              </p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-auto text-sm text-amber-900">
                {value.invalidEntries.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
