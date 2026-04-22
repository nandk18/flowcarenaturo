import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FlaskConical, Plus, Mail, Phone, MapPin, Trash2, Pencil, Send, Loader2, Search, Globe, Building2, ShieldCheck } from "lucide-react";

type Lab = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: "internal" | "external";
  verified: boolean;
  clinic_id: string | null;
  registered_by_clinic_id: string | null;
};

export default function LabsManagement() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"my" | "directory">("my");

  // My labs (internal owned + external linked)
  const [myInternal, setMyInternal] = useState<Lab[]>([]);
  const [myExternalLinks, setMyExternalLinks] = useState<{ id: string; lab: Lab }[]>([]);
  const [loadingMy, setLoadingMy] = useState(false);

  // Directory
  const [directory, setDirectory] = useState<Lab[]>([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const [search, setSearch] = useState("");

  // Add/edit modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lab | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [inviteToApp, setInviteToApp] = useState(false);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Lab | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchMyLabs = async () => {
    if (!profile?.clinic_id) return;
    setLoadingMy(true);
    const [internalRes, linksRes] = await Promise.all([
      supabase.from("labs").select("*").eq("clinic_id", profile.clinic_id).eq("type", "internal").order("name"),
      supabase.from("clinic_labs").select("id, labs(*)").eq("clinic_id", profile.clinic_id),
    ]);
    setMyInternal((internalRes.data || []) as Lab[]);
    setMyExternalLinks(((linksRes.data || []) as any[]).map(l => ({ id: l.id, lab: l.labs })).filter(x => x.lab));
    setLoadingMy(false);
  };

  const fetchDirectory = async () => {
    setLoadingDir(true);
    let q = supabase.from("labs").select("*").eq("type", "external").order("verified", { ascending: false }).order("name");
    if (search.trim()) {
      q = q.or(`name.ilike.%${search.trim()}%,address.ilike.%${search.trim()}%`);
    }
    const { data } = await q.limit(100);
    setDirectory((data || []) as Lab[]);
    setLoadingDir(false);
  };

  useEffect(() => { if (profile?.clinic_id) fetchMyLabs(); }, [profile]);
  useEffect(() => { if (tab === "directory") fetchDirectory(); }, [tab, search]);

  const linkedLabIds = new Set(myExternalLinks.map(l => l.lab.id));

  const openAdd = () => {
    setEditing(null);
    setName(""); setEmail(""); setPhone(""); setAddress(""); setInviteToApp(false);
    setDialogOpen(true);
  };

  const openEdit = (lab: Lab) => {
    setEditing(lab);
    setName(lab.name); setEmail(lab.email || ""); setPhone(lab.phone || ""); setAddress(lab.address || "");
    setInviteToApp(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !profile?.clinic_id) { toast.error("Lab name is required"); return; }
    if (inviteToApp && !email.trim()) { toast.error("Email required to invite the lab"); return; }
    setSaving(true);
    try {
      let labId: string;
      if (editing) {
        const { error } = await supabase.from("labs").update({
          name: name.trim(), email: email.trim() || null,
          phone: phone.trim() || null, address: address.trim() || null,
        }).eq("id", editing.id);
        if (error) throw error;
        labId = editing.id;
        toast.success("Lab updated");
      } else {
        const insertPayload: any = {
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          type: "internal",
          registered_by_clinic_id: profile.clinic_id,
          clinic_id: profile.clinic_id,
          verified: true,
        };
        const { data, error } = await supabase.from("labs").insert(insertPayload).select().single();
        if (error) throw error;
        labId = data.id;
        toast.success("Internal lab added");
      }

      if (inviteToApp && email.trim()) {
        const { error: inviteErr } = await supabase.functions.invoke("invite-staff", {
          body: { email: email.trim(), role: "lab", lab_id: labId },
        });
        if (inviteErr) toast.error("Lab saved but invite failed: " + (inviteErr.message || "Unknown"));
        else toast.success(`Invitation sent to ${email}`);
      }

      setDialogOpen(false);
      fetchMyLabs();
    } catch (err: any) {
      toast.error(err.message || "Failed to save lab");
    } finally {
      setSaving(false);
    }
  };

  const handleAddFromDirectory = async (lab: Lab) => {
    if (!profile?.clinic_id) return;
    const { error } = await supabase.from("clinic_labs").insert({ clinic_id: profile.clinic_id, lab_id: lab.id });
    if (error) { toast.error(error.message); return; }
    toast.success(`Added ${lab.name} to your clinic`);
    fetchMyLabs();
  };

  const handleUnlinkExternal = async (linkId: string, labName: string) => {
    const { error } = await supabase.from("clinic_labs").delete().eq("id", linkId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Unlinked ${labName}`);
    fetchMyLabs();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setRemoving(true);
    try {
      const { error } = await supabase.from("labs").delete().eq("id", confirmDelete.id);
      if (error) throw error;
      toast.success("Lab removed");
      setConfirmDelete(null);
      fetchMyLabs();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

  const handleSendInvite = async (lab: Lab) => {
    if (!lab.email) { toast.error("This lab has no email on file. Edit and add an email first."); return; }
    try {
      const { error } = await supabase.functions.invoke("invite-staff", {
        body: { email: lab.email, role: "lab", lab_id: lab.id },
      });
      if (error) throw error;
      toast.success(`Invitation sent to ${lab.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send invite");
    }
  };

  if (profile?.role !== "admin") return null;

  const renderLabRow = (lab: Lab, opts: { showUnlink?: { linkId: string }; showDelete?: boolean } = {}) => (
    <div key={lab.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="font-semibold text-foreground">{lab.name}</p>
          <Badge variant="outline" className={`text-xs rounded-md ${lab.type === "internal" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}`}>
            {lab.type === "internal" ? <><Building2 className="h-3 w-3 mr-1 inline" />Internal</> : <><Globe className="h-3 w-3 mr-1 inline" />External</>}
          </Badge>
          {lab.verified && (
            <Badge variant="outline" className="text-xs rounded-md bg-success/10 text-success border-success/20">
              <ShieldCheck className="h-3 w-3 mr-1 inline" />Verified
            </Badge>
          )}
        </div>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {lab.email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {lab.email}</p>}
          {lab.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {lab.phone}</p>}
          {lab.address && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {lab.address}</p>}
        </div>
      </div>
      <div className="flex gap-1">
        {lab.type === "internal" && lab.email && (
          <Button size="sm" variant="ghost" onClick={() => handleSendInvite(lab)} title="Send portal invitation">
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
        {lab.type === "internal" && (
          <Button size="sm" variant="ghost" onClick={() => openEdit(lab)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {opts.showUnlink && (
          <Button size="sm" variant="ghost" onClick={() => handleUnlinkExternal(opts.showUnlink!.linkId, lab.name)} title="Remove from my clinic" className="text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {opts.showDelete && (
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(lab)} title="Delete" className="text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card className="rounded-2xl border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 font-display">
          <FlaskConical className="h-5 w-5 text-primary" /> Labs
        </CardTitle>
        <Button size="sm" onClick={openAdd} className="rounded-lg">
          <Plus className="mr-1 h-4 w-4" /> Add Lab
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="my" className="rounded-lg">My Labs</TabsTrigger>
            <TabsTrigger value="directory" className="rounded-lg">Lab Directory</TabsTrigger>
          </TabsList>

          <TabsContent value="my" className="space-y-3 mt-4">
            {loadingMy ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : myInternal.length === 0 && myExternalLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No labs yet. Add an internal lab or browse the Lab Directory.
              </p>
            ) : (
              <>
                {myInternal.map(lab => renderLabRow(lab, { showDelete: true }))}
                {myExternalLinks.map(({ id, lab }) => renderLabRow(lab, { showUnlink: { linkId: id } }))}
              </>
            )}
          </TabsContent>

          <TabsContent value="directory" className="space-y-3 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search labs by name or location..." className="pl-9 rounded-lg" />
            </div>
            {loadingDir ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : directory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No labs found.</p>
            ) : (
              directory.map(lab => (
                <div key={lab.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-foreground">{lab.name}</p>
                      <Badge variant="outline" className="text-xs rounded-md bg-muted text-muted-foreground">
                        <Globe className="h-3 w-3 mr-1 inline" />External
                      </Badge>
                      {lab.verified && (
                        <Badge variant="outline" className="text-xs rounded-md bg-success/10 text-success border-success/20">
                          <ShieldCheck className="h-3 w-3 mr-1 inline" />Verified
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {lab.email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {lab.email}</p>}
                      {lab.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {lab.phone}</p>}
                      {lab.address && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {lab.address}</p>}
                    </div>
                  </div>
                  <div>
                    {linkedLabIds.has(lab.id) ? (
                      <Badge variant="secondary" className="rounded-md">Added</Badge>
                    ) : (
                      <Button size="sm" onClick={() => handleAddFromDirectory(lab)} className="rounded-lg">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add to My Clinic
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Edit Lab" : "Add Lab"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!editing && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Lab Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setLabType("internal")}
                    className={`border rounded-lg py-2.5 text-sm font-medium transition-colors ${labType === "internal" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                    🏥 Internal
                    <div className="text-xs font-normal mt-0.5 opacity-75">Private to your clinic</div>
                  </button>
                  <button type="button" onClick={() => setLabType("external")}
                    className={`border rounded-lg py-2.5 text-sm font-medium transition-colors ${labType === "external" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                    🌐 External
                    <div className="text-xs font-normal mt-0.5 opacity-75">Visible to all clinics</div>
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2"><Label>Lab Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunrise Diagnostics" className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="orders@lab.com" className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..." className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Lab address" className="rounded-lg" /></div>
            {!editing && labType === "internal" && email && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div>
                  <Label className="text-sm">Invite Lab to App</Label>
                  <p className="text-xs text-muted-foreground">Send portal access to {email}</p>
                </div>
                <Switch checked={inviteToApp} onCheckedChange={setInviteToApp} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (editing ? "Save Changes" : "Add Lab")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Lab?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{confirmDelete?.name}</strong>? Past orders and results will remain but won't be linked to this lab.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={removing}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={removing}>
              {removing ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
