import { supabase } from "./supabase";

export async function getProfile() {
  const { data: userData } =
    await supabase.auth.getUser();

  if (!userData.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  return data;
}