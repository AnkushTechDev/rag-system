import './globals.css';
export const metadata = {
  title: 'RAG Workshop — Understand every step',
  description:
    'A JavaScript RAG learning lab with inspectable retrieval, source citations, pipeline traces, and interview practice.',
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
