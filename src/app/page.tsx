"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { success } from "zod";

export default function Home() {
  const[value, setValue] = useState("");

  const trpc = useTRPC();
  const {data: messages} = useQuery(trpc.messages.getMany.queryOptions())
  const createMessage = useMutation(trpc.messages.create.mutationOptions({
    onSuccess: () => {
      toast.success("Message created successfully!");
    },
    onError: (err) => {
      toast.error(`Error creating message: ${err.message}`);
    }
  }));

  return (
    <div className="p-4 max-w-7xl mx-auto">

      {/* just a small input box*/}
      <Input value={value} onChange={(e) => {
        setValue(e.target.value);
      }} className="resize-none h-12" />
      <Button disabled={createMessage.isPending} onClick={() => createMessage.mutate({value:value})}>Create Message</Button>

      {/* display messages */}
      <div className="mt-4">
        {messages?.map((msg) => (
          <div key={msg.id} className="p-2 border-b">
            {msg.content}
          </div>
        ))}
      </div>
    </div>
  );
}