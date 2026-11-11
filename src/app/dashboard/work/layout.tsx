import type {ReactNode} from "react";
import {WorkNavigation} from "@/components/work/work-navigation";
export default function WorkDashboardLayout({children}:{children:ReactNode}){
 return <div className="space-y-5"><WorkNavigation/>{children}</div>;
}
