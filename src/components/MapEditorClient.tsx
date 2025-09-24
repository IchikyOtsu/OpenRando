"use client";

import dynamic from "next/dynamic";

const MapEditor = dynamic(() => import("./MapEditor"), { ssr: false });

export default function MapEditorClient() {
  return <MapEditor />;
}
