export const themes = { // https://spectrum.adobe.com/page/color/
    light: {
        font: '#121319', background: '#EEEEEE',
        gray50: '#BBC9D0', gray100: '#B1C1C9', gray150: '#A6B9C2', gray200: '#9CB0BA', gray300: '#87A0AC', gray400: '#718F9D',
        gray500: '#607D8B', gray600: '#4F6773', gray700: '#3F525B', gray750: '#36474F', gray800: '#2E3C43', gray850: '#263137'
    },
    dark: {
        background: '#121319', font: '#EEEEEE',
        gray850: '#BBC9D0', gray800: '#B1C1C9', gray750: '#A6B9C2', gray700: '#9CB0BA', gray600: '#87A0AC', gray500: '#718F9D',
        gray400: '#607D8B', gray300: '#4F6773', gray200: '#3F525B', gray150: '#36474F', gray100: '#2E3C43', gray50: '#263137'
    },
    light1: {
        gray50: '#ffffff', gray75: '#fafafa', gray100: '#f5f5f5', 
        gray200: '#eaeaea', gray300: '#e1e1e1', gray400: '#cacaca', gray500: '#b3b3b3', gray600: '#8e8e8e', gray700: '#6e6e6e', gray800: '#4b4b4b', gray900: '#2c2c2c',
        blue400: '#2680eb', blue500: '#1473e6', blue600: '#0d66d0', blue700: '#095aba',
        red400: '#e34850', red500: '#d7373f', red600: '#c9252d', red700: '#bb121a',
        green400: '#2d9d78', green500: '#268e6c', green600: '#12805c', green700: '#107154'
    },
    dark1: {
        gray50: '#252525', gray75: '#2f2f2f', gray100: '#323232', 
        gray200: '#3e3e3e', gray300: '#4a4a4a', gray400: '#5a5a5a', gray500: '#6e6e6e', gray600: '#909090', gray700: '#b9b9b9', gray800: '#e3e3e3', gray900: '#ffffff',
        blue400: '#2680eb', blue500: '#378ef0', blue600: '#4b9cf5', blue700: '#5aa9fa',
        red400: '#e34850', red500: '#ec5b62', red600: '#f76d74', red700: '#ff7b82',
        green400: '#2d9d78', green500: '#33ab84', green600: '#39b990', green700: '#3fc89c'
    }
};

// const Root = () => {
//     const dark = localStorage.getItem('theme') === 'dark';
//     const theme = dark ? themes.dark : themes.light;
//     return <JssProvider id={{ minify: false }}>
//         <ThemeProvider theme={theme}>
//             <EmitterProvider><App /><Alert /></EmitterProvider>
//         </ThemeProvider>
//     </JssProvider>;
// };