import { useNavigate } from "react-router-dom";
import { ChevronDown, User as UserIcon, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuditLog, AUDIT_ACTIONS } from "@/hooks/useAuditLog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ProfileMenu() {
  const { profile, user, signOut } = useAuth();
  const { log } = useAuditLog();
  const navigate = useNavigate();
  const initial = profile?.full_name?.charAt(0).toUpperCase() ?? "U";

  const handleLogout = async () => {
    await log(AUDIT_ACTIONS.LOGOUT, "auth", user?.id, user?.email);
    await signOut();
    navigate("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initial}
          </span>
          <span className="hidden truncate text-sm font-medium sm:inline max-w-[140px]">
            {profile?.full_name ?? "User"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {profile?.full_name}
          <div className="truncate text-[10px]">{user?.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings/clinic")}>
          <UserIcon className="mr-2 h-4 w-4" /> My Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
