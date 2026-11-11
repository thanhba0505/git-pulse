import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { S2SAuthGuard } from "./s2s-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { generateS2SSignature } from "./s2s-crypto.util";

describe("S2SAuthGuard", () => {
  let guard: S2SAuthGuard;
  let prismaMock: {
    serviceConnection: {
      findFirst: jest.Mock;
    };
  };

  const secret = "gw_to_gp_s2s_secret_2026";

  beforeEach(() => {
    prismaMock = {
      serviceConnection: {
        findFirst: jest.fn(),
      },
    };
    guard = new S2SAuthGuard(prismaMock as unknown as PrismaService);
  });

  function createMockContext(
    headers: Record<string, string>,
    body?: unknown,
    url = "/api/v1/webhook",
    method = "POST",
  ) {
    const request = {
      headers,
      body,
      url,
      originalUrl: url,
      method,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it("should throw UnauthorizedException when signature headers are missing", async () => {
    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      "Missing required S2S signature headers",
    );
  });

  it("should throw UnauthorizedException when timestamp is expired (> 5 min)", async () => {
    const expiredTimestamp = (Date.now() - 6 * 60 * 1000).toString();
    const context = createMockContext({
      "x-s2s-service": "central-gateway",
      "x-s2s-timestamp": expiredTimestamp,
      "x-s2s-signature": "mock_signature",
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      "S2S request timestamp expired or clock skew too high",
    );
  });

  it("should throw UnauthorizedException when service is not registered", async () => {
    prismaMock.serviceConnection.findFirst.mockResolvedValue(null);

    const timestamp = Date.now().toString();
    const context = createMockContext({
      "x-s2s-service": "unregistered-service",
      "x-s2s-timestamp": timestamp,
      "x-s2s-signature": "mock_signature",
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      "Unauthorized S2S service: unregistered-service",
    );
  });

  it("should throw UnauthorizedException when HMAC signature is invalid", async () => {
    prismaMock.serviceConnection.findFirst.mockResolvedValue({
      slug: "central-gateway",
      incomingSecret: secret,
      isActive: true,
    });

    const timestamp = Date.now().toString();
    const context = createMockContext({
      "x-s2s-service": "central-gateway",
      "x-s2s-timestamp": timestamp,
      "x-s2s-signature": "tampered_or_invalid_signature",
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      "Invalid S2S HMAC signature",
    );
  });

  it("should pass and attach serviceConnection when valid signature is provided", async () => {
    const mockConnection = {
      slug: "central-gateway",
      incomingSecret: secret,
      isActive: true,
    };
    prismaMock.serviceConnection.findFirst.mockResolvedValue(mockConnection);

    const timestamp = Date.now().toString();
    const body = { event: "PING" };
    const path = "/api/v1/webhook";
    const method = "POST";

    const validSignature = generateS2SSignature(
      secret,
      timestamp,
      method,
      path,
      body,
    );

    const context = createMockContext(
      {
        "x-s2s-service": "central-gateway",
        "x-s2s-timestamp": timestamp,
        "x-s2s-signature": validSignature,
      },
      body,
      path,
      method,
    );

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(
      (context.switchToHttp().getRequest() as Record<string, unknown>)
        .serviceConnection,
    ).toEqual(mockConnection);
  });
});
