"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { success } from "zod";

export default function Home() {
  const[value, setValue] = useState("");

  const router = useRouter()
  const trpc = useTRPC();
  const createProject = useMutation(trpc.projects.create.mutationOptions({
    onError: (err) => {
      toast.error(`Error creating project: ${err.message}`);
    },
    onSuccess: (data) => {
      toast.success(`Project created successfully: ${data.id}`);
      router.push(`/projects/${data.id}`);
    }
  }));

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <div className="max-wsc mx-auto flex w-full item-center max-w-lg flex-col gap-4">

      {/* just a small input box*/}
      <Input value={value} onChange={(e) => {
        setValue(e.target.value);
      }} className="resize-none h-12" />
      <Button disabled={createProject.isPending} onClick={() => createProject.mutate({value})}>Submit</Button>

      </div>
    </div>
  );
}