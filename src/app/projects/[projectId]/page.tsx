
interface Props{
    params: Promise<{
        projectId: string;
    }>
}



 const Page = async ({ params }: Props) => {
    const { projectId } = await params;
    return (
        <div>
            <h1>Project Page: {projectId}</h1>
        </div>
    );
};

export default Page;