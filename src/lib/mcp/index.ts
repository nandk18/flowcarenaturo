import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchPatients from "./tools/search-patients";
import listAppointments from "./tools/list-appointments";
import listTherapySessions from "./tools/list-therapy-sessions";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "flowcare-mcp",
  title: "FlowCare Clinic MCP",
  version: "0.1.0",
  instructions:
    "Tools for a FlowCare clinic account. Search patients, list appointments and therapy sessions for a given date. All data is scoped to the signed-in user's clinic.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchPatients, listAppointments, listTherapySessions],
});
