import { useEffect, useRef, HTMLAttributes } from 'react';

export const Textarea = ({ defaultValue, ...props }: HTMLAttributes<HTMLTextAreaElement>) => {
    const element = useRef<HTMLTextAreaElement>();
    const adjustSize = () => {
        element.current.style.height = '0px'; // reset height
        element.current.style.height = element.current.scrollHeight && `${Math.min(element.current.scrollHeight, 85)}px` || ''; // set scroll height - max 3 rows
    };
    useEffect(adjustSize, [defaultValue]);
    return <textarea ref={element} defaultValue={defaultValue} onChangeCapture={adjustSize} {...props} />
};
