import { LegalPageLayout } from "@/components/public/LegalPageLayout";

export default function PoliticaPrivacidadPage() {
  return (
    <LegalPageLayout title="Política de Privacidad">
      <p>
        AIRLOGIX AI trata los datos personales conforme al RGPD y la LOPDGDD. Los datos recogidos
        mediante formularios de contacto se utilizan exclusivamente para responder a solicitudes
        comerciales o de soporte.
      </p>
      <p>
        Tienes derecho de acceso, rectificación, supresión, limitación, portabilidad y oposición.
        Para ejercerlos, escríbenos a través del formulario de contacto.
      </p>
      <p>
        No cedemos datos a terceros salvo obligación legal o proveedores necesarios para la prestación
        del servicio (hosting, email).
      </p>
    </LegalPageLayout>
  );
}
