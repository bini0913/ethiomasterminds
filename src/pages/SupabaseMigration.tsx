import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  ShieldAlert,
  Database,
  KeyRound,
  Cloud,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import BackButton from "@/components/ui/BackButton";

type StepKey = "rotate" | "connect" | "credentials" | "migrate" | "verify";

const STEPS: { key: StepKey; title: string; description: string }[] = [
  {
    key: "rotate",
    title: "Rotate exposed credentials",
    description: "Your service_role key and DB password were shared in chat. Reset them first.",
  },
  {
    key: "connect",
    title: "Link Supabase to Lovable",
    description: "Use Lovable's native Supabase connector in the sidebar.",
  },
  {
    key: "credentials",
    title: "Save project credentials",
    description: "Store your project URL, ref, and keys for the migration step.",
  },
  {
    key: "migrate",
    title: "Run the migration",
    description: "Push schema, data, storage, and edge functions to your project.",
  },
  {
    key: "verify",
    title: "Verify and switch over",
    description: "Confirm row counts match and the app reads from your Supabase.",
  },
];

const SupabaseMigration = () => {
  const [completed, setCompleted] = useState<Record<StepKey, boolean>>({
    rotate: false,
    connect: false,
    credentials: false,
    migrate: false,
    verify: false,
  });

  const [creds, setCreds] = useState({
    projectUrl: "https://vahzghlzdkopsoffylvv.supabase.co",
    projectRef: "vahzghlzdkopsoffylvv",
    anonKey: "",
  });

  const toggle = (key: StepKey) =>
    setCompleted((c) => ({ ...c, [key]: !c[key] }));

  const copy = async (text: string, label: string) => {
    if (!text) {
      toast.error(`No ${label} to copy`);
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const completedCount = Object.values(completed).filter(Boolean).length;
  const progress = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <BackButton />

        <header className="mt-4 mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Cloud className="h-6 w-6 text-primary" />
            </div>
            <Badge variant="secondary">Migration Guide</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Move to your own Supabase
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            A guided, five-step flow to authorize and link your Supabase project, then transfer
            every table, function, file, and edge function from Lovable Cloud into it.
          </p>

          <div className="mt-6 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount} of {STEPS.length} steps
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        {/* Step 1 — Rotate */}
        <Card className="mb-6 border-destructive/40">
          <CardHeader>
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggle("rotate")}
                className="mt-1"
                aria-label="Toggle complete"
              >
                {completed.rotate ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Step 1 — Critical</Badge>
                </div>
                <CardTitle className="mt-2">Rotate your exposed credentials</CardTitle>
                <CardDescription>
                  Your <code>service_role</code> key and database password were pasted in chat.
                  Anyone with chat access has full admin rights to your project. Rotate both
                  before doing anything else.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Security risk</AlertTitle>
              <AlertDescription>
                The leaked service_role key bypasses every Row Level Security policy. Treat it
                like a root password.
              </AlertDescription>
            </Alert>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild variant="outline">
                <a
                  href={`https://supabase.com/dashboard/project/${creds.projectRef}/settings/api`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset service_role key
                  <ExternalLink className="h-3 w-3 ml-2" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={`https://supabase.com/dashboard/project/${creds.projectRef}/settings/database`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Reset database password
                  <ExternalLink className="h-3 w-3 ml-2" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 2 — Connect */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start gap-3">
              <button onClick={() => toggle("connect")} className="mt-1">
                {completed.connect ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1">
                <Badge>Step 2</Badge>
                <CardTitle className="mt-2">Link Supabase to this Lovable project</CardTitle>
                <CardDescription>
                  Lovable has a native Supabase integration. This is the only way for Lovable to
                  push migrations and deploy edge functions to your project.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2">
                <span className="font-semibold text-primary">1.</span>
                <span>
                  Open the <strong>Connectors</strong> panel in the left sidebar of Lovable.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-primary">2.</span>
                <span>
                  Find <strong>Supabase</strong> and click <strong>Connect</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-primary">3.</span>
                <span>
                  Authorize Lovable, then choose your project (ref{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    {creds.projectRef}
                  </code>
                  ).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-primary">4.</span>
                <span>
                  Wait for Lovable to confirm the integration is active.
                </span>
              </li>
            </ol>
            <Alert>
              <AlertDescription>
                Once linked, this project's <code>.env</code>, generated types, and edge function
                deploys will target your Supabase instead of Lovable Cloud.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 3 — Credentials */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start gap-3">
              <button onClick={() => toggle("credentials")} className="mt-1">
                {completed.credentials ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1">
                <Badge>Step 3</Badge>
                <CardTitle className="mt-2">Save your project credentials</CardTitle>
                <CardDescription>
                  Keep these handy locally. Only the <strong>publishable (anon)</strong> key is
                  safe to paste here.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div>
                <Label htmlFor="url">Project URL</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="url"
                    value={creds.projectUrl}
                    onChange={(e) =>
                      setCreds({ ...creds, projectUrl: e.target.value })
                    }
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copy(creds.projectUrl, "Project URL")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="ref">Project Ref</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="ref"
                    value={creds.projectRef}
                    onChange={(e) =>
                      setCreds({ ...creds, projectRef: e.target.value })
                    }
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copy(creds.projectRef, "Project Ref")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="anon">Anon (publishable) key</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="anon"
                    placeholder="eyJhbGci..."
                    value={creds.anonKey}
                    onChange={(e) =>
                      setCreds({ ...creds, anonKey: e.target.value })
                    }
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copy(creds.anonKey, "Anon key")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Never paste your service_role key or DB password here.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 4 — Migrate */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start gap-3">
              <button onClick={() => toggle("migrate")} className="mt-1">
                {completed.migrate ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1">
                <Badge>Step 4</Badge>
                <CardTitle className="mt-2">Run the migration</CardTitle>
                <CardDescription>
                  After Lovable is connected (Step 2), tell the Lovable agent in chat:{" "}
                  <em>"Supabase is now connected — push the migrations and deploy the edge
                  functions to my project."</em>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="font-medium mb-2">What gets migrated</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 62 database tables, all RLS policies, enums, triggers</li>
                <li>• 27 SECURITY DEFINER functions (has_role, add_xp, multiplayer_*, ...)</li>
                <li>• 12 edge functions including ai-tutor and library-ai</li>
                <li>• 3 storage buckets (~180 MB of PDFs and images)</li>
                <li>• 100+ user records via the Supabase Admin API</li>
                <li>• Realtime publication for chat and multiplayer tables</li>
              </ul>
            </div>
            <Alert>
              <AlertDescription>
                Plan for ~5–15 minutes of partial downtime while data is dumped and restored.
                Best done when no users are active.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 5 — Verify */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start gap-3">
              <button onClick={() => toggle("verify")} className="mt-1">
                {completed.verify ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1">
                <Badge>Step 5</Badge>
                <CardTitle className="mt-2">Verify and switch over</CardTitle>
                <CardDescription>
                  Confirm parity, then test that the app reads from your Supabase.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-2 text-muted-foreground">
              <li>• Check row counts match for <code>profiles</code>, <code>quiz_results</code>, <code>library_books</code></li>
              <li>• Sign in with an existing user to confirm auth works</li>
              <li>• Open the AI Tutor to confirm edge functions deploy and respond</li>
              <li>• Verify a multiplayer room and live chat to confirm realtime is on</li>
            </ul>
            <Separator />
            <Button asChild className="w-full">
              <a
                href={`https://supabase.com/dashboard/project/${creds.projectRef}`}
                target="_blank"
                rel="noreferrer"
              >
                Open my Supabase dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupabaseMigration;
