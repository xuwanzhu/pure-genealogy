import { Suspense } from "react";
import { fetchMembersWithBiography } from "./actions";
import { BiographyBookLoader } from "./biography-book-loader";
import { getSessionUser } from "@/lib/auth";

export async function generateMetadata() {
    const user = await getSessionUser();
    const surname = user?.family_surname || "";
    return {
        title: surname ? `${surname}氏生平册` : "家族生平册",
        description: "家族生平事迹集",
    };
}

async function BookContent() {
    const [{ data: members, error }, user] = await Promise.all([
        fetchMembersWithBiography(),
        getSessionUser(),
    ]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-900">
                <div className="text-center text-white">
                    <p className="text-lg">加载失败</p>
                    <p className="text-sm text-white/60 mt-2">{error}</p>
                </div>
            </div>
        );
    }

    if (members.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-900">
                <div className="text-center text-white">
                    <p className="text-lg">暂无族谱成员</p>
                    <p className="text-sm text-white/60 mt-2">请先在成员管理中添加成员，所有成员都将自动收入生平册</p>
                </div>
            </div>
        );
    }

    return <BiographyBookLoader members={members} surname={user?.family_surname || undefined} />;
}

export default function BiographyBookPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-stone-900">
                    <div className="text-center text-white">
                        <div className="animate-spin mb-4">
                            <svg
                                className="h-8 w-8 mx-auto text-amber-500"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                ></circle>
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                        </div>
                        <p className="text-lg font-serif">正在展卷...</p>
                    </div>
                </div>
            }
        >
            <BookContent />
        </Suspense>
    );
}
