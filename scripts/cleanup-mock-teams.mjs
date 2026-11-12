import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env.local", "utf8");
const getEnv = (key) => {
  const match = envText.match(new RegExp("^" + key + "=(.*)$", "m"));
  return match ? match[1].trim() : "";
};

const supabase = createClient(
  getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
);

async function cleanup() {
  console.log("Cleaning up mock test teams...");
  
  // Clean from teams table
  const { data: teamsDeleted, error: err1 } = await supabase
    .from("teams")
    .delete()
    .ilike("name", "MOCK_TEST_TEAM_%")
    .select("id, name");

  console.log(`Deleted from teams table: ${teamsDeleted?.length || 0} teams.`);
  if (err1) console.error("Error in teams cleanup:", err1.message);

  // Clean from team_registrations table if any
  const { data: regsDeleted, error: err2 } = await supabase
    .from("team_registrations")
    .delete()
    .ilike("team_name", "MOCK_TEST_TEAM_%")
    .select("id, team_name");

  console.log(`Deleted from team_registrations table: ${regsDeleted?.length || 0} teams.`);
  if (err2) console.error("Error in team_registrations cleanup:", err2.message);

  console.log("Cleanup complete!");
}

cleanup();
