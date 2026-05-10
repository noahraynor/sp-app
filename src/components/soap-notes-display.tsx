import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SoapNotes } from '@/types';

interface SoapNotesDisplayProps {
  soapNotes: SoapNotes;
}

const SECTIONS: { key: keyof SoapNotes; title: string; letter: string }[] = [
  { key: 'subjective', title: 'Subjective', letter: 'S' },
  { key: 'objective', title: 'Objective', letter: 'O' },
  { key: 'assessment', title: 'Assessment', letter: 'A' },
  { key: 'plan', title: 'Plan', letter: 'P' },
];

export function SoapNotesDisplay({ soapNotes }: SoapNotesDisplayProps) {
  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => (
        <Card key={section.key}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {section.letter}
              </span>
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm text-gray-700">
              {soapNotes[section.key] || 'No content available.'}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
