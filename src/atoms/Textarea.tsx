import { useEffect, useRef, HTMLAttributes } from 'react';

export const Textarea = (props: { value: string } & HTMLAttributes<HTMLTextAreaElement>) => {
    const element = useRef<HTMLTextAreaElement>();
    useEffect(() => {
        element.current.style.height = '0px'; // reset height
        element.current.style.height = element.current.scrollHeight && `${element.current.scrollHeight}px` || ''; // set scroll height
    }, [props.value]);
    return <textarea ref={element} {...props} />
};
