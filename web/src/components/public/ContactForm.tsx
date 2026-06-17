"use client";

import { useState } from "react";

interface Props {
  title?: string;
  submitLabel?: string;
}

export function ContactForm({ title = "Contacto", submitLabel = "Enviar" }: Props) {
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-xl bg-[#172a45] p-8 text-center">
        <p className="text-[#41ead4] font-semibold">Mensaje enviado. Te contactaremos pronto.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
      <input
        required
        name="name"
        placeholder="Nombre"
        className="w-full rounded-lg bg-[#172a45] border border-[#2a3f5f] px-4 py-3 text-white placeholder:text-[#a8b2d1] focus:outline-none focus:border-[#41ead4]"
      />
      <input
        required
        type="email"
        name="email"
        placeholder="Email"
        className="w-full rounded-lg bg-[#172a45] border border-[#2a3f5f] px-4 py-3 text-white placeholder:text-[#a8b2d1] focus:outline-none focus:border-[#41ead4]"
      />
      <textarea
        required
        name="message"
        rows={5}
        placeholder="Mensaje"
        className="w-full rounded-lg bg-[#172a45] border border-[#2a3f5f] px-4 py-3 text-white placeholder:text-[#a8b2d1] focus:outline-none focus:border-[#41ead4]"
      />
      <button
        type="submit"
        className="w-full rounded-full bg-[#41ead4] py-3 font-bold text-[#0d1b2a] hover:bg-[#31b59d] transition"
      >
        {submitLabel}
      </button>
    </form>
  );
}
