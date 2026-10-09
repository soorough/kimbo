import type { ExtractReportRequest } from "@kimbo/shared";
import { useMutation } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { DISCLAIMER } from "./copy";
import { readAsBase64, toUploadableJpeg } from "./image";
import { api } from "./api";
import { useReportDraft } from "./report-draft";

/**
 * Every way into a report (file, camera, sample, typing) ends on the same review
 * screen. Used by the blood report screen and the optional onboarding step, which passes
 * from: "onboarding" so the review hands back to setup instead of going to Today.
 */
export function useReportIntake(opts: { from?: "onboarding" } = {}) {
  const setDraft = useReportDraft((s) => s.set);

  const extract = useMutation({
    // File preparation runs inside the mutation so any failure shows as an error state.
    mutationFn: async ({ load }: { load: () => Promise<ExtractReportRequest>; source: "upload" | "sample" }) =>
      api.extractReport(await load()),
    onSuccess: (draft, { source }) => {
      setDraft(draft, source);
      router.push({ pathname: "/report-review", params: opts.from ? { from: opts.from } : {} });
    },
  });

  async function pickFile() {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    const mimeType = asset.mimeType ?? "application/pdf";
    extract.mutate({
      source: "upload",
      load: async () => {
        if (mimeType.startsWith("image/")) {
          const image = await toUploadableJpeg(asset.uri);
          return { fileBase64: image.base64, mimeType: image.mimeType };
        }
        return { fileBase64: await readAsBase64(asset.uri), mimeType };
      },
    });
  }

  async function snapReport() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"] });
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    extract.mutate({
      source: "upload",
      load: async () => {
        const image = await toUploadableJpeg(asset.uri);
        return { fileBase64: image.base64, mimeType: image.mimeType };
      },
    });
  }

  function trySample() {
    extract.mutate({ load: async () => ({ sample: true }), source: "sample" });
  }

  function enterManually() {
    setDraft({ markers: [], reportDate: null, ignored: [], supportedMarkers: [], disclaimer: DISCLAIMER }, "manual");
    router.push({ pathname: "/report-review", params: opts.from ? { from: opts.from } : {} });
  }

  return {
    pickFile,
    snapReport,
    trySample,
    enterManually,
    reading: extract.isPending,
    error: extract.error,
  };
}
