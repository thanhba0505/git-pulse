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
import { SsoCallbackDto } from "./dto/sso-callback.dto";
import { JwtAuthGuard, AuthenticatedUser } from "./guards/jwt-auth.guard";

@ApiTags("Authentication & Gateway SSO")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("sso/callback")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Xác thực Single Sign-On (SSO) từ Central Gateway qua PKCE",
  })
  async loginWithSso(
    @Body() dto: SsoCallbackDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.loginWithSso(dto, response);
  }

  @Post("google")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Đăng nhập qua Google OAuth ủy quyền Central Gateway",
  })
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.loginWithGoogle(dto, response);
  }

  @Get("dev/users")
  @ApiOperation({
    summary: "Lấy danh sách tài khoản phục vụ popup đăng nhập nhanh trên dev",
  })
  async getDevUsers() {
    return this.authService.getDevUsers();
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Lấy thông tin người dùng đang đăng nhập" })
  async getProfile(@Req() req: Request & { user: AuthenticatedUser }) {
    return { user: req.user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đăng xuất và xóa phiên làm việc" })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("git_pulse_session", { path: "/" });
    res.clearCookie("access_token", { path: "/" });
    return { success: true };
  }
}
