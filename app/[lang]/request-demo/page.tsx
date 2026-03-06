"use client";

import React, { useState } from "react";
import { HowItWorks } from "@/components/how-it-works";
import { ContactFormModal } from "@/components/ContactFormModal";
import { Button } from "@/components/ui/button";

export default function RequestDemoPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center mb-8">
        <h1 className="text-3xl font-bold">Request a demo</h1>
        <p className="mt-2 text-muted-foreground">Tell us your fleet size and goals.</p>
      </div>

      <div className="max-w-6xl mx-auto grid gap-6">
        <HowItWorks dict={{ howItWorks: "How it works" }} />

        <div className="pt-6 pb-12 text-center">
          <p className="mb-4 text-lg">Ready to start?</p>
          <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-teal-500 to-blue-600 text-white">
            Request demo
          </Button>
        </div>
      </div>

      <ContactFormModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
