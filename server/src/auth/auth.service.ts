import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { AuthenticatedUser } from "./guards/jwt-auth.guard";

interface GatewayUserResponse {
  user?: {
    id: string;
    username: string;
    email?: string | null;
    role: string;
    avatarUrl?: string | null;
    isActive?: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly gatewayUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.gatewayUrl = process.env.GATEWAY_URL || "http://localhost:5101/api/v1";
  }

  async loginWithGoogle(
    dto: GoogleLoginDto,
  ): Promise<{ user: AuthenticatedUser; token: string }> {
    let email = dto.email?.toLowerCase();
    let name = dto.name;
    let googleId = dto.googleId;

    if (dto.credential && (!email || !googleId)) {
      try {
        const decoded = this.jwtService.decode(dto.credential) as Record<
          string,
          unknown
        > | null;
        if (decoded) {
          if (typeof decoded.email === "string")
            email = decoded.email.toLowerCase();
          if (typeof decoded.name === "string") name = decoded.name;
          if (typeof decoded.sub === "string") googleId = decoded.sub;
        }
      } catch (err) {
        this.logger.warn(
          `Failed to decode credential: ${(err as Error).message}`,
        );
      }
    }

    if (!email) {
      throw new BadRequestException(
        "Không thể trích xuất địa chỉ email từ tài khoản Google.",
      );
    }

    // Call Central Gateway IAM /auth/google
    let gatewayUser: {
      id: string;
      username: string;
      email?: string | null;
      avatarUrl?: string | null;
      role: string;
    } | null = null;

    try {
      const response = await fetch(`${this.gatewayUrl}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || email.split("@")[0],
          googleId: googleId || `google_${Date.now()}`,
          avatarUrl: dto.avatarUrl,
          credential: dto.credential,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as GatewayUserResponse;
        if (data.user) {
          gatewayUser = {
            id: data.user.id,
            username: data.user.username,
            email: data.user.email,
            avatarUrl: data.user.avatarUrl,
            role: data.user.role,
          };
        }
      } else {
        this.logger.warn(
          `Central Gateway responded with status ${response.status}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Could not reach Central Gateway at ${this.gatewayUrl}: ${(err as Error).message}`,
      );
    }

    // If Gateway is offline during local development, fallback gracefully to shadow profile
    if (!gatewayUser) {
      gatewayUser = {
        id: `gw_${Buffer.from(email).toString("hex").slice(0, 16)}`,
        username: name || email.split("@")[0],
        email,
        avatarUrl: dto.avatarUrl || null,
        role: "USER",
      };
    }

    const localUser = await this.syncShadowUser(gatewayUser);
    const token = this.generateSessionToken(localUser.id, localUser.email);

    return {
      user: {
        id: localUser.id,
        gatewayUserId: localUser.gatewayUserId,
        email: localUser.email,
        username: localUser.username,
        avatarUrl: localUser.avatarUrl,
        role: localUser.role,
      },
      token,
    };
  }

  async getDevUsers(): Promise<
    Array<{ id: string; email: string; username: string; role: string }>
  > {
    try {
      const res = await fetch(`${this.gatewayUrl}/auth/dev/users`);
      if (res.ok) {
        return (await res.json()) as Array<{
          id: string;
          email: string;
          username: string;
          role: string;
        }>;
      }
    } catch {
      // Fallback local dev users
    }

    return [
      {
        id: "dev-user-1",
        email: "admin@gitpulse.local",
        username: "Pulsar Admin",
        role: "ADMIN",
      },
      {
        id: "dev-user-2",
        email: "dev@gitpulse.local",
        username: "Cosmic Developer",
        role: "USER",
      },
    ];
  }

  async devQuickLogin(
    email: string,
    username: string,
  ): Promise<{ user: AuthenticatedUser; token: string }> {
    const localUser = await this.syncShadowUser({
      id: `dev_${Buffer.from(email).toString("hex").slice(0, 16)}`,
      username,
      email,
      role: "USER",
    });

    const token = this.generateSessionToken(localUser.id, localUser.email);
    return {
      user: {
        id: localUser.id,
        gatewayUserId: localUser.gatewayUserId,
        email: localUser.email,
        username: localUser.username,
        avatarUrl: localUser.avatarUrl,
        role: localUser.role,
      },
      token,
    };
  }

  async syncShadowUser(gwUser: {
    id: string;
    username: string;
    email?: string | null;
    avatarUrl?: string | null;
    role: string;
  }) {
    const email =
      gwUser.email || `${gwUser.username.toLowerCase()}@gateway.local`;

    return this.prisma.user.upsert({
      where: { email },
      update: {
        gatewayUserId: gwUser.id,
        username: gwUser.username,
        avatarUrl: gwUser.avatarUrl,
      },
      create: {
        gatewayUserId: gwUser.id,
        email,
        username: gwUser.username,
        avatarUrl: gwUser.avatarUrl,
        settings: {
          create: {
            defaultAiEngine: "GITHUB_MODELS",
            githubModelName: "gpt-4o-mini",
            language: "vi",
          },
        },
      },
    });
  }

  private generateSessionToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email }, { expiresIn: "30d" });
  }
}
