import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { McpScope } from './mcp.constants';
import { McpKeysService } from './mcp-keys.service';

export interface McpAuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  mcpScopes: McpScope[];
  mcpKeyId: string;
}

@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(private readonly mcpKeysService: McpKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Partial<McpAuthenticatedRequest> & Request>();
    const authHeader = req.headers.authorization;
    const match = authHeader?.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();

    if (!token) {
      throw new UnauthorizedException(
        'Thiếu Authorization Bearer MCP API Key. Tạo key trong Cài đặt Git Pulse.',
      );
    }

    const session = await this.mcpKeysService.validateToken(token);
    req.user = session.user;
    req.mcpScopes = session.scopes;
    req.mcpKeyId = session.keyId;
    return true;
  }
}
