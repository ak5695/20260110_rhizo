import { getById } from "@/actions/documents";
import { DocumentEditorLayout } from "@/components/document/document-editor-layout";
import { notFound } from "next/navigation";

interface DocumentPreviewPageProps {
  params: Promise<{
    documentId: string;
  }>;
}

const DocumentPreviewPage = async ({
  params
}: DocumentPreviewPageProps) => {
  const { documentId } = await params;

  const document = await getById(documentId);

  if (!document) {
    return notFound();
  }

  return (
    <div className="h-full dark:bg-[#1F1F1F]">
      <DocumentEditorLayout
        document={document}
        documentId={document.id}
        isReadOnly={true}
      />
    </div>
  );
}

export default DocumentPreviewPage;
