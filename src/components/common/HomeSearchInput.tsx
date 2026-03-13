'use client';

import SearchAutocomplete from '@/components/common/SearchAutocomplete';

type Props = {
  placeholder: string;
  ariaLabel: string;
};

export default function HomeSearchInput({ placeholder, ariaLabel }: Props) {
  return (
    <SearchAutocomplete
      inputId="search-input"
      inputName="q"
      placeholder={placeholder}
      onSelect={(item) => {
        window.location.href = item.href;
      }}
    />
  );
}
