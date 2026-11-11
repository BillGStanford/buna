/** Site-wide configuration and navigation map. */
export const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() || "the Buna team";
export const siteConfig = {
  name: "Buna",
  tagline: "Discover startups. Find talent. Build together.",
  description: "Buna connects African startups, founders, investors and independent professionals through discovery, launches, community and paid work.",
};
export const TERMS_VERSION = "2026-10-20";
export type NavItem = {label:string;href:string;available:boolean};
export const primaryNav:NavItem[]=[
 {label:"Discover",href:"/startups",available:true},{label:"Launches",href:"/launches",available:true},
 {label:"Work",href:"/work",available:true},{label:"Investors",href:"/investor",available:true},
 {label:"Community",href:"/community",available:true},{label:"Opportunities",href:"/opportunities",available:true},
 {label:"Founders",href:"/founders",available:true},{label:"About",href:"/about",available:true},
];
export const dashboardNav:NavItem[]=[
 {label:"Overview",href:"/dashboard",available:true},{label:"Activity feed",href:"/dashboard/activity",available:true},
 {label:"Referrals & rewards",href:"/dashboard/referrals",available:true},{label:"Work",href:"/dashboard/work",available:true},
 {label:"Investor Portal",href:"/dashboard/investor-portal",available:true},{label:"Profile",href:"/dashboard/profile",available:true},
 {label:"Security",href:"/dashboard/security",available:true},{label:"Settings",href:"/dashboard/settings",available:true},
 {label:"My startups",href:"/dashboard/startup",available:true},{label:"My launches",href:"/dashboard/launches",available:true},
 {label:"Following",href:"/dashboard/following",available:true},{label:"Inquiries",href:"/dashboard/inquiries",available:true},
 {label:"Saved",href:"/dashboard/saved",available:true},{label:"Notifications",href:"/dashboard/notifications",available:true},
];
export const availableNav=(items:NavItem[])=>items.filter(i=>i.available);
