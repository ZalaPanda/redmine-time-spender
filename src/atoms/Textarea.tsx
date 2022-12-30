import { useEffect, useRef, HTMLAttributes } from 'react';

interface TextareaProps extends HTMLAttributes<HTMLTextAreaElement> {
    value: string
};

export const Textarea = ({ value, ...props }: TextareaProps) => {
    const element = useRef<HTMLTextAreaElement>();
    useEffect(() => {
        element.current.style.height = '0px'; // reset height
        element.current.style.height = element.current.scrollHeight && `${Math.min(element.current.scrollHeight, 85)}px` || ''; // set scroll height - max 3 rows
    }, [value]);
    return <textarea ref={element} value={value} {...props} />
};
