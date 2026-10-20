import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { listPhotos } from "@/features/body/service";
import { PhotoUploader } from "@/components/body/photo-uploader";
import { PhotoGallery } from "@/components/body/photo-gallery";
import { todayInTimeZone } from "@/utils/date";

export const metadata: Metadata = { title: "Progress photos" };

export default async function PhotosPage() {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const photos = await listPhotos();
  return (
    <div className="flex flex-col gap-5">
      <PhotoUploader userId={user.id} today={todayInTimeZone(profile?.timezone ?? "UTC")} />
      <PhotoGallery photos={photos} />
    </div>
  );
}
