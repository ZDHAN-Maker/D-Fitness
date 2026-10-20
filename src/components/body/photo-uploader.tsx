"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { registerPhotoAction } from "@/features/body/actions";
import { compressImage } from "@/lib/images/compress";
import { PHOTO_BUCKET, buildPhotoPath } from "@/lib/images/photo";
import { createClient } from "@/lib/supabase/client";

const INPUT_LIMIT = 30 * 1024 * 1024; // refuse absurd originals before decoding

/** Resize in the browser, upload straight to the private bucket, then register path + metadata on the server. */
export function PhotoUploader({ userId, today }: { userId: string; today: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(today);
  const [pose, setPose] = useState("front");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string>();
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState<"compress" | "upload" | null>(null);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const pick = (f: File | undefined) => {
    setError(undefined);
    setDone(false);
    if (preview) URL.revokeObjectURL(preview);
    if (!f) return setFile(undefined), setPreview(undefined);
    if (!f.type.startsWith("image/")) return setError("Please choose an image file.");
    if (f.size > INPUT_LIMIT) return setError("That file is too large. Pick a photo under 30 MB.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const upload = async () => {
    if (!file) return;
    setError(undefined);
    try {
      setBusy("compress");
      const blob = await compressImage(file);
      setBusy("upload");
      const path = buildPhotoPath(userId, crypto.randomUUID(), "image/jpeg");
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error("The upload failed. Check your connection and try again.");

      const res = await registerPhotoAction({ path, takenOn: date, pose, note, mimeType: "image/jpeg", sizeBytes: blob.size });
      if (!res.ok) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path]); // do not leave an unregistered file behind
        throw new Error(res.error);
      }
      setDone(true);
      setFile(undefined);
      setNote("");
      if (preview) URL.revokeObjectURL(preview);
      setPreview(undefined);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div>
        <input ref={fileRef} id="photo-file" type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        <label htmlFor="photo-file" className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center hover:bg-accent/40 focus-within:ring-2">
          {preview ? (
            // Local object URL preview; not an optimisable remote image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selected photo preview" className="max-h-56 rounded-md object-contain" />
          ) : (
            <>
              <Camera className="size-7 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">Take or choose a photo</span>
              <span className="text-xs text-muted-foreground">Resized on your device before upload. Stored privately.</span>
            </>
          )}
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="p-date" label="Date">
          <Input {...fieldAria("p-date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id="p-pose" label="Pose">
          <Select {...fieldAria("p-pose")} value={pose} onChange={(e) => setPose(e.target.value)}>
            <option value="front">Front</option>
            <option value="side">Side</option>
            <option value="back">Back</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field id="p-note" label="Note (optional)">
          <Input {...fieldAria("p-note")} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {done ? <p role="status" className="text-sm font-medium text-fiber">Photo saved.</p> : null}

      <Button type="button" onClick={upload} disabled={!file || busy !== null}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {busy === "compress" ? "Preparing…" : busy === "upload" ? "Uploading…" : "Upload photo"}
      </Button>
    </div>
  );
}
