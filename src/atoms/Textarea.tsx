import { useEffect, useRef, HTMLAttributes } from 'react';

interface TextareaProps extends HTMLAttributes<HTMLTextAreaElement> {
    value: string
};

export const Textarea = (props: TextareaProps) => {
    const element = useRef<HTMLTextAreaElement>();
    useEffect(() => {
        element.current.style.height = '0px'; // reset height
        element.current.style.height = element.current.scrollHeight && `${element.current.scrollHeight}px` || ''; // set scroll height
    }, [props.value]);
    return <textarea ref={element} {...props} />
};
