import { LegalPageLayout } from "@/components/public/LegalPageLayout";

export default function PoliticaCookiesPage() {
  return (
    <LegalPageLayout title="Política de Cookies">
      <p>
        Este sitio puede utilizar cookies técnicas necesarias para el funcionamiento y cookies
        analíticas para mejorar la experiencia de usuario.
      </p>
      <p>
        Puedes configurar tu navegador para rechazar cookies, aunque algunas funcionalidades
        podrían verse afectadas.
      </p>
      <p>
        Las cookies de sesión de BROKI se utilizan para mantener la autenticación del dashboard.
      </p>
    </LegalPageLayout>
  );
}
