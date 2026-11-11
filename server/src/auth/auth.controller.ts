import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Response, Request } from "express";
import { AuthService } from "./auth.service";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { JwtAuthGuard, AuthenticatedUser } from "./guards/jwt-auth.guard";

@ApiTags("Authentication & Gateway SSO")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("google")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login via Google through Central Gateway SSO" })
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const { user, token } = await this.authService.loginWithGoogle(dto);

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("git_pulse_session", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return { user };
  }

  @Get("dev/users")
  @ApiOperation({ summary: "Get list of dev accounts for testing" })
  async getDevUsers() {
    return this.authService.getDevUsers();
  }

  @Post("dev/quick-login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Quick login for local development" })
  async devQuickLogin(
    @Body() body: { email: string; username: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const { user, token } = await this.authService.devQuickLogin(
      body.email,
      body.username,
    );

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("git_pulse_session", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return { user };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get currently authenticated user" })
  async getProfile(
    @Req() req: Request & { user: AuthenticatedUser },
  ): Promise<{ user: AuthenticatedUser }> {
    return { user: req.user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Clear session cookie" })
  async logout(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean }> {
    res.clearCookie("git_pulse_session", { path: "/" });
    return { success: true };
  }
}
