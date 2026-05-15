"use client";

import { useState } from "react";
import { Database01, Link01 } from "@untitledui/icons";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { useConnection } from "@/stores/connection";
import type { Connection } from "@/lib/s3/types";
import type { SealedConnection } from "@/lib/credentials/types";

const EMPTY: Connection = {
  bucket: "",
  accessKeyId: "",
  secretAccessKey: "",
  accountId: "",
  endpoint: "",
  region: "auto",
};

export function ConnectForm() {
  const { setSealed } = useConnection();
  const [form, setForm] = useState<Connection>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const update =
    <K extends keyof Connection>(key: K) =>
    (value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const candidate: Connection = {
        bucket: form.bucket.trim(),
        accessKeyId: form.accessKeyId.trim(),
        secretAccessKey: form.secretAccessKey.trim(),
        accountId: form.accountId?.trim() || undefined,
        endpoint: form.endpoint?.trim() || undefined,
        region: form.region?.trim() || "auto",
      };
      if (
        !candidate.bucket ||
        !candidate.accessKeyId ||
        !candidate.secretAccessKey
      ) {
        toast.error("Bucket, access key id, and secret access key are required.");
        return;
      }
      if (!candidate.accountId && !candidate.endpoint) {
        toast.error("Provide either an R2 account id or a custom S3 endpoint.");
        return;
      }

      const response = await fetch("/api/credentials/seal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(candidate),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(body?.error || `Connection failed (${response.status})`);
        return;
      }
      const sealed = (await response.json()) as SealedConnection;
      if (!sealed?.token || !sealed?.preview) {
        toast.error("Server did not return sealed credentials.");
        return;
      }
      toast.success(`Connected to ${sealed.preview.bucket}`);
      setSealed(sealed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-lg space-y-4 rounded-2xl bg-primary p-8 shadow-xl ring-1 ring-secondary"
    >
      <div className="flex items-start gap-4">
        <FeaturedIcon icon={Database01} color="brand" theme="light" size="md" />
        <div>
          <h1 className="text-lg font-semibold text-primary">
            Connect a bucket
          </h1>
          <p className="mt-1 text-sm text-tertiary">
            Credentials are encrypted on the server and never stored in
            plaintext in this browser. Only a sealed token lives in localStorage.
          </p>
        </div>
      </div>

      <Input
        size="sm"
        label="Bucket name"
        placeholder="my-bucket"
        value={form.bucket}
        onChange={update("bucket")}
        isRequired
      />

      <Input
        size="sm"
        label="Account ID"
        placeholder="7bee75f5...be36"
        hint="Used to build the R2 endpoint. Leave empty if you set a custom endpoint."
        value={form.accountId ?? ""}
        onChange={update("accountId")}
      />

      <Input
        size="sm"
        label="Access Key ID"
        value={form.accessKeyId}
        onChange={update("accessKeyId")}
        isRequired
      />
      <Input
        size="sm"
        label="Secret Access Key"
        type="password"
        value={form.secretAccessKey}
        onChange={update("secretAccessKey")}
        isRequired
      />
      <Input
        size="sm"
        label="Custom S3 Endpoint (Optional)"
        placeholder="https://s3.example.com"
        hint="Optional. Used when not connecting to R2."
        value={form.endpoint ?? ""}
        onChange={update("endpoint")}
      />
      <Input
        label="Region (Optional)"
        placeholder="auto"
        value={form.region ?? ""}
        onChange={update("region")}
      />

      <Button
        type="submit"
        size="md"
        isLoading={submitting}
        iconLeading={Link01}
        className="w-full"
      >
        Connect
      </Button>
    </form>
  );
}
