import "server-only";
import { CredentialsError, buildClient, parseCredentials } from "./client";
import { friendlyMessage, statusFromError } from "./errors";
import type { Connection } from "./types";
import type { S3Client } from "@aws-sdk/client-s3";

export type WithClient = (request: Request, ctx: { client: S3Client; conn: Connection }) => Promise<Response>;

export function withClient(handler: WithClient) {
    return async (request: Request): Promise<Response> => {
        let conn: Connection;
        try {
            conn = parseCredentials(request);
        } catch (error) {
            const message = error instanceof CredentialsError ? error.message : "Invalid credentials";
            return Response.json({ error: message }, { status: 401 });
        }

        const client = buildClient(conn);
        try {
            return await handler(request, { client, conn });
        } catch (error) {
            // Keep the raw error in the server log for debugging; send a friendly one to the client.
            console.error("[s3 route error]", error);
            return Response.json({ error: friendlyMessage(error) }, { status: statusFromError(error) });
        } finally {
            client.destroy();
        }
    };
}
