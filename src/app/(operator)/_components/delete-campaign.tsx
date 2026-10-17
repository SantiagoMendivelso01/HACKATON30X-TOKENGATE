"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { t } from "@/i18n";
import { deleteCampaignAction } from "../actions";

interface Props {
  campaignId: string;
  campaignName: string;
  leads: number;
  deletable: boolean;
}

export function DeleteCampaign({ campaignId, campaignName, leads, deletable }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!deletable) {
    return (
      <span className="text-xs text-muted" title={t("deleteCampaign.blocked")}>
        {t("deleteCampaign.blockedShort")}
      </span>
    );
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const r = await deleteCampaignAction(campaignId, confirm);
      if (r.ok) {
        dialog.current?.close();
        router.push("/");
        router.refresh();
      } else setError(t(`deleteCampaign.error_${r.reason}`));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setConfirm("");
          setError(null);
          dialog.current?.showModal();
        }}
        className="rounded-[var(--radius)] border border-line bg-surface px-3 py-1.5 text-sm font-medium text-attention hover:border-attention"
      >
        {t("deleteCampaign.button")}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="del-title"
        className="m-auto w-[min(28rem,92vw)] rounded-[var(--radius)] border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
      >
        <form
          method="dialog"
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            remove();
          }}
        >
          <h2 id="del-title" className="text-lg font-bold">
            {t("deleteCampaign.title")}
          </h2>
          <p className="text-sm">
            {t("deleteCampaign.body", { name: campaignName, leads: leads === 1 ? t("deleteCampaign.leadsOne") : t("deleteCampaign.leadsMany", { n: leads }) })}
          </p>
          <p className="text-sm font-semibold text-attention">{t("deleteCampaign.irreversible")}</p>
          <label className="block space-y-1 text-sm">
            <span>{t("deleteCampaign.typeToConfirm")}</span>
            <input
              autoFocus
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2"
              autoComplete="off"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-attention">
              ! {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-[var(--radius)] border border-line px-4 py-2 text-sm font-medium">
              {t("deleteCampaign.cancel")}
            </button>
            <button
              type="submit"
              disabled={pending || confirm.trim().toLowerCase() !== "borrar"}
              className="rounded-[var(--radius)] bg-attention px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? t("deleteCampaign.deleting") : t("deleteCampaign.confirm")}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
