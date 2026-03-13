'use client';

import SearchAutocomplete from '@/components/common/SearchAutocomplete';

type Props = {
  inputId: string;
  inputName: string;
  placeholder: string;
};

export default function SearchFormClient({ inputId, inputName, placeholder }: Props) {
  return (
    <SearchAutocomplete
      inputId={inputId}
      inputName={inputName}
      placeholder={placeholder}
      onSelect={(item) => {
        window.location.href = item.href;
      }}
    />
  );
}
