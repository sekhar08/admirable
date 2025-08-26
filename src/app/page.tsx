"use client"

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { success } from "zod";

export default function Home() {

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

      <Button disabled={invoke.isPending} onClick={() => invoke.mutate({text:"Chandra"})}>Invoke Background Job</Button>

    </div>
  );
}