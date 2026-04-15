import { supabase } from '../lib/supabase';

const BUCKET = 'govt-ids';
const SIGNED_URL_EXPIRY = 60 * 60;

export async function uploadIdProof(memberId, fileUri, fileName) {
  const ext = fileName.split('.').pop();
  const path = `${memberId}/id-proof.${ext}`;

  const response = await fetch(fileUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: `image/${ext}`,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  await supabase
    .from('family_members')
    .update({ id_proof_url: path })
    .eq('id', memberId);

  return getSignedUrl(path);
}

export async function uploadFacePhoto(memberId, fileUri, fileName) {
  const ext = fileName.split('.').pop();
  const path = `${memberId}/face-photo.${ext}`;

  const response = await fetch(fileUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: `image/${ext}`,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  await supabase
    .from('family_members')
    .update({ face_photo_url: path })
    .eq('id', memberId);

  return getSignedUrl(path);
}

export async function getSignedUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);
  if (error) throw error;
  return data.signedUrl;
}

export async function getSignedUrls(paths) {
  const results = {};
  await Promise.all(
    paths.map(async ({ key, path }) => {
      if (!path) {
        results[key] = null;
        return;
      }
      try {
        results[key] = await getSignedUrl(path);
      } catch {
        results[key] = null;
      }
    })
  );
  return results;
}
