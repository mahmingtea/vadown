import { getAppVersion } from "@/lib/get-app-version";
import { useEffect, useState } from "react";

export default function AppVersion() {
    const [appVersion, setAppVersion] = useState("");
    useEffect(() => {
        getAppVersion().then((version) => {
            setAppVersion(version);
        });
    }, []);
    return (
        <div className="text-center text-xs text-muted-foreground pt-4 pb-2 fixed bottom-0 left-0 right-0">
            vadown-v{appVersion}
        </div>
    )
}