import { NextResponse, type NextRequest } from "next/server";

// 与 lib/auth.ts 中的 SESSION_COOKIE 保持一致
// (不能直接 import lib/auth,因为 proxy 运行在 Edge 运行时,而 auth 依赖 Node-only 的 mysql2)
const SESSION_COOKIE = "genealogy_session";

export async function proxy(request: NextRequest) {
  // 首页重定向到族谱关系图
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/family-tree/graph";
    return Response.redirect(url);
  }

  // 放行认证相关页面
  if (request.nextUrl.pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // 检查会话 cookie 是否存在 (轻量检查,完整校验在服务端 getSessionUser 中进行)
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
