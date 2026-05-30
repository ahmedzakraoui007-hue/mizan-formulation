type PageLoaderProps = {
  label?: string;
  fullscreen?: boolean;
};

export default function PageLoader({ label = "Chargement...", fullscreen = false }: PageLoaderProps) {
  return (
    <div className={`${fullscreen ? "fixed inset-0 z-[100] min-h-dvh" : "min-h-screen"} grid place-items-center bg-slate-50`}>
      <div className="flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-r-emerald-600 animate-spin" />
        <p className="text-sm font-bold text-slate-500">{label}</p>
      </div>
    </div>
  );
}
