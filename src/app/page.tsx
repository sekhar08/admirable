"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { success } from "zod";

export default function Home() {
  const[value, setValue] = useState("");

  const trpc = useTRPC();
  const invoke = useMutation(trpc.invoke.mutationOptions({
    onSuccess: () => {
      toast.success("Background job invoked! Check your terminal after a few seconds.");
    },
    onError: (err) => {
      toast.error(`Error invoking background job: ${err.message}`);
    }
  }));

  return (
    <div className="p-4 max-w-7xl mx-auto">

      {/* just a small input box*/}
      <Input value={value} onChange={(e) => {
        setValue(e.target.value);
      }} className="resize-none h-12" />
      <Button disabled={invoke.isPending} onClick={() => invoke.mutate({value:value})}>Invoke Background Job</Button>

    </div>
  );
}