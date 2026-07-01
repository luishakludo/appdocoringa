"use client"

import dynamic from "next/dynamic"

const Beams = dynamic(() => import("@/components/Beams"), { ssr: false })

export function BeamsBackground() {
  return (
    <div className="absolute inset-0 z-0">
      <Beams
        beamWidth={3}
        beamHeight={30}
        beamNumber={10}
        lightColor="#ff2647"
        speed={2}
        noiseIntensity={1.75}
        scale={0.2}
        rotation={30}
      />
    </div>
  )
}
